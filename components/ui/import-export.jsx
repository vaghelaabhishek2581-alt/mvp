import * as React from "react"
import { Button } from "./button"

const ImportExport = ({ onImport, getElements }) => {
  const handleImport = () => {
    // Basic import functionality placeholder
    console.log('Import clicked')
  }

  const handleExport = () => {
    const elements = getElements()
    console.log('Export clicked:', elements)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleImport}>
        Import
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport}>
        Export
      </Button>
    </div>
  )
}

export { ImportExport }