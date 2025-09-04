import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { parseFountain, exportToFountain } from '@/lib/convert/fountain';
import { parseFDX, exportToFDX } from '@/lib/convert/fdx';
import { exportToPDF } from '@/lib/pdfExport';
import { Download, Upload } from 'lucide-react';

export function ImportExport({ onImport, getElements }) {
  const [importing, setImporting] = useState(false);

  const handleImport = (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    
    switch (type) {
      case 'fountain':
        input.accept = '.fountain';
        break;
      case 'fdx':
        input.accept = '.fdx';
        break;
      case 'pdf':
        input.accept = '.pdf';
        break;
    }
    
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setImporting(true);
      try {
        const text = await file.text();
        let elements = [];
        
        switch (type) {
          case 'fountain':
            elements = parseFountain(text);
            break;
          case 'fdx':
            elements = await parseFDX(text);
            break;
          case 'pdf':
            // PDF parsing would require additional libraries
            console.log('PDF import not implemented yet');
            break;
        }
        
        onImport?.(elements);
      } catch (error) {
        console.error('Import failed:', error);
        alert('Import failed. Please check the file format.');
      } finally {
        setImporting(false);
      }
    };
    
    input.click();
  };

  const handleExport = (type) => {
    const elements = getElements?.() || [];
    
    switch (type) {
      case 'fountain':
        const fountainContent = exportToFountain(elements);
        downloadFile(fountainContent, 'screenplay.fountain', 'text/plain');
        break;
      case 'fdx':
        const fdxContent = exportToFDX(elements);
        downloadFile(fdxContent, 'screenplay.fdx', 'application/xml');
        break;
      case 'pdf':
        const pdf = exportToPDF(elements);
        pdf.save('screenplay.pdf');
        break;
    }
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={importing}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleImport('fountain')}>
            Fountain (.fountain)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleImport('fdx')}>
            Final Draft (.fdx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleImport('pdf')}>
            PDF (.pdf)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleExport('fountain')}>
            Fountain (.fountain)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('fdx')}>
            Final Draft (.fdx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
            PDF (.pdf)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}