import React, { useState } from 'react';
import { 
  VscChevronRight, VscChevronDown, VscDatabase, 
  VscTable, VscKey, VscSymbolField 
} from "react-icons/vsc";
import { useEditor } from '../context/EditorContext';

const TableNode = ({ table, databaseName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { updateSQL, executeSQL, activeTabId } = useEditor();

  const handleTableClick = async (e) => {
    e.stopPropagation();
    const query = `SELECT * FROM ${table.name} LIMIT 100;`;
    updateSQL(activeTabId, query);
    // Use setTimeout to ensure state update propagates before execution if needed, 
    // or just pass query directly to executeSQL
    executeSQL(query);
  };

  return (
    <div className="tree-node">
      <div 
        className="tree-item table-item" 
        onClick={() => setIsExpanded(!isExpanded)}
        onDoubleClick={handleTableClick}
      >
        {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
        <VscTable className="icon-table" />
        <span>{table.name}</span>
      </div>
      
      {isExpanded && (
        <div className="tree-children">
          {table.columns.map((col, idx) => (
            <div key={idx} className="tree-item column-item">
              <VscSymbolField className="icon-column" />
              <span>{col}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarExplorer = ({ schema }) => {
  const [isDbExpanded, setIsDbExpanded] = useState(true);

  return (
    <div className="sidebar-explorer scrollbar">
      <div className="sidebar-header">Explorer: Database</div>
      
      <div className="tree-root">
        <div 
          className="tree-item db-item" 
          onClick={() => setIsDbExpanded(!isDbExpanded)}
        >
          {isDbExpanded ? <VscChevronDown /> : <VscChevronRight />}
          <VscDatabase className="icon-db" />
          <span>CURRENT DATABASE</span>
        </div>

        {isDbExpanded && (
          <div className="tree-children">
            {schema.length > 0 ? (
              schema.map((table, idx) => (
                <TableNode key={idx} table={table} />
              ))
            ) : (
              <div className="empty-msg">No tables found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarExplorer;
