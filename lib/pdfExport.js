import jsPDF from 'jspdf';

export function exportToPDF(elements) {
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  
  // Screenplay margins in points
  const margins = {
    top: 36, // 0.5 inch
    left: 108, // 1.5 inch
    right: 72, // 1 inch
    bottom: 72 // 1 inch
  };

  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;
  
  let currentY = margins.top;
  let pageNumber = 1;

  // Set font
  pdf.setFont('Courier', 'normal');
  pdf.setFontSize(12);

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const lineHeight = 14;
    
    // Calculate element positioning
    let x = margins.left;
    let fontSize = 12;
    let fontStyle = 'normal';
    
    switch (element.type) {
      case 'scene_heading':
        fontStyle = 'bold';
        currentY += 24; // Extra space before scene heading
        break;
      case 'character':
        x = margins.left + 220;
        fontStyle = 'bold';
        currentY += 24;
        break;
      case 'dialogue':
        x = margins.left + 100;
        break;
      case 'parenthetical':
        x = margins.left + 160;
        fontStyle = 'italic';
        break;
      case 'transition':
        x = pageWidth - margins.right - 200;
        fontStyle = 'bold';
        currentY += 24;
        break;
      case 'shot':
        fontStyle = 'bold';
        currentY += 12;
        break;
      case 'super':
        fontStyle = 'bold';
        currentY += 12;
        break;
      default: // action
        currentY += 12;
        break;
    }

    pdf.setFont('Courier', fontStyle);
    pdf.setFontSize(fontSize);

    // Split text into lines that fit the width
    const maxWidth = element.type === 'dialogue' ? contentWidth - 250 : 
                    element.type === 'parenthetical' ? contentWidth - 360 :
                    element.type === 'character' ? contentWidth - 220 :
                    element.type === 'transition' ? 200 : contentWidth;

    const lines = pdf.splitTextToSize(element.content, maxWidth);

    // Check if we need a new page
    if (currentY + (lines.length * lineHeight) > pageHeight - margins.bottom) {
      pdf.addPage();
      pageNumber++;
      currentY = margins.top;
      
      // Add page number
      pdf.setFont('Courier', 'normal');
      pdf.setFontSize(12);
      pdf.text(`${pageNumber}.`, pageWidth - margins.right - 50, margins.top - 10);
      
      pdf.setFont('Courier', fontStyle);
      pdf.setFontSize(fontSize);
    }

    // Add the text
    for (const line of lines) {
      pdf.text(line, x, currentY);
      currentY += lineHeight;
    }

    currentY += 12; // Space after element
  }

  return pdf;
}